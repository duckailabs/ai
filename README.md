# FatduckAI AI package

![duck_banner](https://github.com/user-attachments/assets/33c039c6-bd6a-436f-952e-fbc88ae07c50)

This package helps to parse AI prompts

# Making Changes

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make your changes

# Create changeset
bun changeset

# Commit changes
git add .
git commit -m "feat: added new feature"
git push origin feature/new-feature


# After PR is merged to main
git checkout master
git pull

# Choose one of:
bun run release:patch  # 1.0.0 -> 1.0.1
bun run release:minor  # 1.0.0 -> 1.1.0
bun run release:major  # 1.0.0 -> 2.0.0

# Push changes
git push && git push --tags
```
