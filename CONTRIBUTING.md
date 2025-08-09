# Contributing to KickStack

Thank you for your interest in contributing to KickStack! We welcome contributions from the community.

## Development Setup

### Prerequisites
- Docker and Docker Compose
- Node.js 20 LTS
- Git

### Local Development

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/KickStack.git
   cd KickStack
   ```

2. **Install dependencies:**
   ```bash
   npm run cli:install
   npm run web:install
   ```

3. **Set up environment:**
   ```bash
   cp infra/.env.example infra/.env
   # Edit infra/.env with your configuration
   ```

4. **Start the infrastructure:**
   ```bash
   cd infra
   docker-compose up -d
   ```

5. **Start development services:**
   ```bash
   # Terminal 1: Dashboard
   npm run web:dev

   # Terminal 2: Functions Gateway
   npm run fngw:dev

   # Terminal 3: Realtime service
   npm run realtime:dev
   ```

## Development Workflow

### Branch Naming Convention
- `feat/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates
- `chore/*` - Maintenance tasks
- `test/*` - Test improvements

### Commit Message Format
We use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat: add new RLS policy preset`
- `fix: correct PostgreSQL connection issue`
- `docs: update API documentation`
- `chore: upgrade dependencies`
- `test: add multi-tenancy integration tests`

### Pull Request Process

1. **Create a feature branch:**
   ```bash
   git checkout -b feat/my-new-feature
   ```

2. **Make your changes and test:**
   ```bash
   # Run unit tests
   cd ai/cli
   npm test

   # Run integration tests
   npm run test:integration
   ```

3. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: add amazing new feature"
   ```

4. **Push to your fork:**
   ```bash
   git push origin feat/my-new-feature
   ```

5. **Create a Pull Request** with:
   - Clear description of changes
   - Link to any related issues
   - Screenshots if UI changes
   - Test results

## Pull Request Checklist

- [ ] Code follows project style guidelines
- [ ] Tests pass locally (`npm test`)
- [ ] Documentation updated if needed
- [ ] No sensitive data or credentials committed
- [ ] Migrations are idempotent
- [ ] RLS policies considered for new tables
- [ ] Environment variables documented in `.env.example`

## Testing

### Running Tests
```bash
# Unit tests
cd ai/cli
npm test

# Specific test file
npm test -- tests/policies/team_scope.test.ts

# Integration tests
npm run test:integration

# Watch mode
npm test -- --watch
```

### Writing Tests
- Place unit tests in `tests/` directories
- Name test files as `*.test.ts`
- Use descriptive test names
- Test both success and failure cases

## Code Style

### TypeScript/JavaScript
- Use TypeScript for new code
- Follow existing code patterns
- Use meaningful variable names
- Add JSDoc comments for public APIs

### SQL/Migrations
- Use lowercase for SQL keywords
- Quote identifiers with double quotes
- Make migrations idempotent (IF NOT EXISTS)
- Add comments to complex queries

### Git Commits
- Keep commits atomic and focused
- Write clear commit messages
- Reference issues when applicable (#123)

## Security

### Reporting Security Issues
**DO NOT** create public issues for security vulnerabilities.

Email security concerns to: security@kickstack.dev

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Security Best Practices
- Never commit credentials or secrets
- Use environment variables for configuration
- Apply RLS policies to all user tables
- Validate and sanitize all inputs
- Keep dependencies updated

## Areas for Contribution

### High Priority
- Additional template marketplace templates
- More RLS policy presets
- Dashboard UI improvements
- API documentation
- Performance optimizations

### Good First Issues
Look for issues labeled `good first issue` in the GitHub repository.

### Feature Requests
Check the [discussions](https://github.com/Clark-Wallace/KickStack/discussions) for feature ideas.

## Community

### Getting Help
- Check existing [issues](https://github.com/Clark-Wallace/KickStack/issues)
- Ask in [discussions](https://github.com/Clark-Wallace/KickStack/discussions)
- Read the documentation

### Code Review Process
All submissions require review. We aim to:
- Provide feedback within 48 hours
- Be constructive and respectful
- Help improve the contribution
- Maintain code quality

## License
By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.

## Questions?
Feel free to ask in the discussions or reach out to the maintainers.

Thank you for contributing to KickStack! 🚀