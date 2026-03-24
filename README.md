# Pervaziv AI Code Review GitHub Action

The **Pervaziv AI Code Review** GitHub Action scans your repository for security vulnerabilities on every push or on a schedule, surfaces findings directly in the GitHub Security tab, and provides a  summary in the Actions tab with a direct link to your Pervaziv AI console report.

This allows developers to detect vulnerabilities during development and track them in both GitHub and Pervaziv AI.

## Prerequisites

Before using this action, ensure the following setup is completed in Pervaziv AI:

1. **Register with Pervaziv AI**
   - The repository owner must have an account on the Pervaziv AI console.
   - NOTE: This code review feature is available for Premium and above subscriptions.

2. **Add the repository**
   - Log in to the Pervaziv AI Console.
   - Add your GitHub repository as a project.

3. **Enable Auto Update**
   - Enable the `auto_update` option for the project.
   - This allows to automatically scan when the GitHub Action triggers.

4. **Enable Auto Code Suggestion**
   - Enable the `Auto Code Suggestion` option for this project.
   - This allows Pervaziv AI to raise a Pull request with code suggestion for the found security vulnerabilities.

## How to install

Create .github/workflows/pervaziv-ai-action.yml in your repository:
```
name: Pervaziv AI Code Review

on:
  push:
    branches:
      - main              # runs on every push to main
  schedule:
    - cron: '0 0 * * *'  # runs every day at midnight UTC

jobs:
  pervaziv-ai-action:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      actions: read
      contents: write         # create fix branch - downgrade to read if Auto Code Suggestion is disabled in Pervaziv console
      pull-requests: write    # open fix PR - remove if Auto Code Suggestion is disabled in Pervaziv console
    steps:
      - uses: pervaziv/pervaziv-ai-code-review@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          console-url: https://console.pervaziv.com

```
## Configuration
Users can customize when the scan runs

### Run on specific branches
```
on:
  push:
    branches:
      - main
      - develop        # run on push to develop
      - 'feature/**'   # run on all feature branches
      - '**'           # run on every branch
```
### Run on every push

```
on:
  push:
```

### Run on schedule

```
on:
  schedule:
    - cron: '0 0 * * *'    # every day at midnight UTC
    - cron: '0 9 * * 1'    # every Monday at 9am UTC
    - cron: '0 0 * * 0'    # every Sunday at midnight UTC
```
Users can configure scans based on their workflow requirements.

### GitHub Repository Permissions - Required for Auto PR Fixes

If you want the workflow to automatically create pull requests for detected vulnerabilities, you must enable the following permissions in the repository:

- Go to your repository on GitHub
- Navigate to: Settings → Actions → General
- Under Workflow permissions:
   - Select Read and write permissions
   - Enable Allow GitHub Actions to create and approve pull requests
- Click Save

## Results

### Actions tab - Job Summary

Go to your repository → Actions tab → click on the running workflow → click Summary.
You will see:

- Repository name
- Branch name
- Trigger type (push or scheduled scan)
- Total findings count
- Link to full scan results on Pervaziv AI console

### Security tab - Code Scanning Alerts

Go to your repository → Security tab → Code scanning.
You will see:

- Individual alerts for each vulnerability detected
- Severity level (Error, Warning, Note)
- File name and line number
- Rule ID and description
- CWE and OWASP tags
- Link to full report on Pervaziv AI console

### Pull Request - AI Code Suggestions

If `Auto Code Suggestion` is enabled in your Pervaziv AI project settings and security vulnerabilities are detected, the action will automatically create a pull request with suggested fixes. You can review these code suggestions in the Pull Requests tab of your repository.