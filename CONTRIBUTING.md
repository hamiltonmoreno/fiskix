# Contribution Guidelines

Thank you for your interest in contributing to Fiskix! We welcome contributions from everyone, whether you're reporting bugs, suggesting improvements, or submitting new features. This guide will outline how to get started with contributing to our project.

## Forking the Repository
1. Navigate to the [Fiskix GitHub repository](https://github.com/hamiltonmoreno/fiskix).
2. Click on the **Fork** button at the top right of the page to create a copy of the repository under your own GitHub account.

## Cloning Your Fork
After forking the repository, clone it to your local machine:
```bash
git clone https://github.com/YOUR-USERNAME/fiskix.git
```
Replace `YOUR-USERNAME` with your GitHub username.

## Creating a Branch
Before making any changes, create a new branch for your work:
```bash
git checkout -b your-feature-branch
```
Use a descriptive name for your branch that reflects the work you are doing.

## Making Changes
Make the necessary changes or additions to the codebase in your branch.

### Commit Conventions
When you are ready to commit your changes, adhere to the following conventions:
- Use the present tense: "Add feature" instead of "Added feature."
- Prefix the commit message with a type:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation only changes
  - `style:` for formatting changes (white-space, formatting, missing semi-colons, etc)
  - `refactor:` for changes that neither fix a bug nor add a feature
- Example commit message:
  ```
  feat: add user login functionality
  ```

## Submitting a Pull Request
Once you have completed your changes and committed them, push your branch to your fork:
```bash
git push origin your-feature-branch
```

Then, navigate to the original repository where you want to submit the pull request:
1. Click on the **Pull Requests** tab.
2. Click on the **New Pull Request** button.
3. Select your branch from the dropdown and create the pull request.
4. Fill out the pull request template and provide a clear description of your changes.

## Code Reviews
After submitting a pull request, the maintainers will review your code. Be prepared to make revisions based on their feedback. If changes are requested, make them in your branch and push them again; your pull request will automatically update.

Thank you for contributing to Fiskix! Your efforts help us improve and grow the project.