const { applyPatch } = require("diff");

// Parse diff into hunks
function parseHunks(diff) {
  const hunks = [];
  const parts = diff.split(/^@@/m).slice(1);

  for (const p of parts) {
    const fullHunk = "@@" + p;

    const match = fullHunk.match(
      /^@@\s-(\d+)(?:,(\d+))?\s\+(\d+)(?:,(\d+))?\s@@/
    );

    if (!match) continue;

    const startLine = Number(match[1]);
    const lineCount = Number(match[2] || "1");
    const endLine = startLine + lineCount - 1;

    hunks.push({
      diff: fullHunk,
      startLine,
      endLine,
      lineCount
    });
  }

  return hunks;
}

// Group overlapping hunks
function groupOverlappingHunks(hunks = []) {
  if (!hunks.length) return [];

  const sorted = [...hunks].sort((a, b) => a.startLine - b.startLine);

  const groups = [];
  let currentGroup = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = currentGroup[currentGroup.length - 1];
    const curr = sorted[i];

    if (!(curr.startLine > prev.endLine || curr.endLine < prev.startLine)) {
      currentGroup.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }

  groups.push(currentGroup);
  return groups;
}

// Normalize diff for applyPatch
function normalizeDiff(filePath, diff) {
  return [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    diff.trim()
  ].join("\n");
}

// Try applyPatch
function tryApplyPatch(currentContent, filePath, diffText) {
  try {
    const normalizedDiff = normalizeDiff(filePath, diffText);
    const patched = applyPatch(currentContent, normalizedDiff);
    if (patched === false) {
      return null;
    }
    return patched;
  } catch (err) {
    return null;
  }
}

// Create Fix PR
async function createFixPr(octokit, context, branch, result) {

  const { data: branchData } = await octokit.rest.repos.getBranch({
    owner: context.repo.owner,
    repo: context.repo.repo,
    branch: branch
  });

  const latestSha = branchData.commit.sha;
  const rand = Math.random().toString(36).slice(2,6);
  const fixBranch = `pervaziv-ai-fix/${latestSha.substring(0, 7)}-${rand}`;

  await octokit.rest.git.createRef({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: `refs/heads/${fixBranch}`,
    sha: latestSha
  });

  console.log(`Fix branch created: ${fixBranch}`);

  for (const suggestion of result.suggestion) {

    const rawHunks = parseHunks(suggestion.diff);

    if (!rawHunks.length) {
      //console.log(`No hunks for ${suggestion.file_path}`);
      continue;
    }

    const hunkGroups = groupOverlappingHunks(rawHunks);

    const { data: file } = await octokit.rest.repos.getContent({
      owner: context.repo.owner,
      repo: context.repo.repo,
      path: suggestion.file_path,
      ref: fixBranch
    });

    const currentContent = Buffer.from(file.content, "base64").toString();

    const patchedContent = tryApplyPatch(currentContent, suggestion.file_path, suggestion.diff);

    let fixedContent;

    if (patchedContent) {
      fixedContent = patchedContent;
    } else {
      const lines = currentContent.split("\n");

      const sortedGroups = [...hunkGroups].sort((a, b) => {
        const aStart = Math.min(...a.map(h => h.startLine));
        const bStart = Math.min(...b.map(h => h.startLine));
        return bStart - aStart;
      });

      for (const group of sortedGroups) {
        const sortedHunks = [...group].sort((a, b) => a.startLine - b.startLine);

        for (const hunk of [...sortedHunks].reverse()) {
          const fixedLines = [];

          for (const line of hunk.diff.split("\n")) {
            if (
              line.startsWith("@@") ||
              line.startsWith("---") ||
              line.startsWith("+++") ||
              line.startsWith("diff ") ||
              line.startsWith("index ")
            ) continue;

            if (line.startsWith("+") || line.startsWith(" ")) {
              fixedLines.push(line.slice(1));
            }
          }

          const startIdx = hunk.startLine - 1;

          if (startIdx < 0 || startIdx >= lines.length) {
            continue;
          }

          lines.splice(startIdx, hunk.lineCount, ...fixedLines);
        }
      }

      fixedContent = lines.join("\n");
    }

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: context.repo.owner,
      repo: context.repo.repo,
      path: suggestion.file_path,
      message: `Fix: ${suggestion.file_path}`,
      content: Buffer.from(fixedContent).toString("base64"),
      branch: fixBranch,
      sha: file.sha
    });

    console.log(`Fix applied to ${suggestion.file_path}`);
  }

  const prBody = [
    "## Pervaziv AI Security Fixes",
    "",
    "| File | Line |",
    "|------|------|",
    ...result.suggestion.map(s => {
      const hunks = parseHunks(s.diff);
      const lines = hunks.map(h => h.startLine).join(", ");
      return `| \`${s.file_path}\` | ${lines} |`;
    }),
    "",
    `[View Full Report on Pervaziv AI Console](${result.security_report_url || 'https://console.pervaziv.com'})`
  ].join("\n");

  const pr = await octokit.rest.pulls.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    title: `Pervaziv AI Code Review — ${result.suggestion.length} fixes`,
    body: prBody,
    head: fixBranch,
    base: branch
  });

  return pr;
}

module.exports = { createFixPr };