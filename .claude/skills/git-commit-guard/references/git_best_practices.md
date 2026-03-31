# Git Commit Best Practices

Source: https://github.com/shuki25/tetris-game-controller/blob/22b0a17eab9a4312831d9790e331fb6e9969cdc6/GitCommitBestPractices.md

## Commit Message Rules

1.  **Summarize changes in around 50 characters or less**
    - The first line should be a short summary of the changes.
    - It should be capitalized.
    - It should be written in the imperative mood (e.g., "Fix bug" not "Fixed bug" or "Fixes bug").

2.  **More detailed explanatory text, if necessary**
    - Separate the summary from the body with a blank line.
    - The body should wrap at around 72 characters.
    - The body should answer:
      - What is the motivation for the change?
      - How does it differ from the previous implementation?
    - Use paragraphs and bullet points (hyphens or asterisks) for readability.

## Commit Timing Rules

1.  **Commit related changes**
    - A commit should contain only related changes.
    - Example: Fixing two different bugs should be two separate commits.
    - Small commits make it easier for other developers to understand the changes and roll them back if something goes wrong.

2.  **Commit often**
    - Committing often keeps your commits small and, again, helps you commit only related changes.
    - It allows you to share your code more frequently with others.
    - It makes it easier for everyone to integrate changes regularly and avoid merge conflicts.

3.  **Don't commit half-done work**
    - You should only commit code when a logical component is completed and tested.
    - Use `git stash` to save your work if you need to switch tasks, rather than committing incomplete code.

4.  **Test before you commit**
    - Resist the temptation to commit something that you "think" is complete.
    - Test it thoroughly to make sure it really is complete and has no side effects (as far as you can tell).

5.  **Use branches**
    - Branches are a powerful mechanism to avoid interspersing different lines of development.
    - Create branches for new features, bug fixes, experiments, etc.

6.  **Agree on a workflow**
    - Git lets you pick from a lot of different workflows: long-running branches, topic branches, merge or rebase, git-flow, etc.
    - Which one you pick depends on a couple of factors: your project, your overall development and deployment workflows and (maybe most importantly) on your personal preferences.
    - However you choose to work, just make sure to agree on a common workflow that everyone follows.
