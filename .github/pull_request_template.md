## 📋 Pull Request Summary

### What does this PR do?
<!-- Provide a clear and concise description of what this PR accomplishes -->

### 🔄 Type of Change
<!-- Mark the relevant option with an [x] -->
- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update (changes to README, CLAUDE.md, or other docs)
- [ ] 🔧 Refactoring (code changes that neither fixes a bug nor adds a feature)
- [ ] ⚡ Performance improvement
- [ ] 🧹 Code cleanup/maintenance
- [ ] 🔒 Security improvement
- [ ] 🧪 Test improvements
- [ ] 🏗️ Build/CI changes

### 🎯 Related Issues
<!-- Link related issues using keywords: "Fixes #123", "Closes #456", "Related to #789" -->
- Fixes #
- Related to #

### 🧪 Testing
<!-- Describe how you tested your changes -->
- [ ] All existing tests pass (`npm test`)
- [ ] New tests added for new functionality
- [ ] Manual testing completed
- [ ] Extension tested in Chrome browser
- [ ] Tested on target platforms (ChatGPT/Claude/Grok)

**Test Details:**
<!-- Describe specific test scenarios you ran -->

### 📝 Implementation Details
<!-- Provide technical details about your implementation -->

#### Changed Files:
<!-- List key files that were modified and why -->
- `src/path/to/file.ts` - Brief description of changes

#### Architecture Impact:
<!-- Describe any architectural changes or impacts -->

### 🔒 Security Considerations
<!-- Address any security implications -->
- [ ] No sensitive data exposed
- [ ] Input validation implemented where needed
- [ ] Chrome extension permissions not expanded unnecessarily
- [ ] No new external network requests added

### 📱 Platform Compatibility
<!-- Check all platforms this change affects -->
- [ ] ChatGPT (chat.openai.com, chatgpt.com)
- [ ] Claude (claude.ai)
- [ ] Grok (x.com, grok.x.ai)
- [ ] Extension popup interface
- [ ] Extension options page

### 🚀 Performance Impact
<!-- Describe any performance implications -->
- [ ] No performance degradation
- [ ] Performance improvements included
- [ ] Bundle size impact: <!-- Describe if applicable -->

### ✅ Pre-submission Checklist
<!-- Verify these items before submitting -->
- [ ] Code follows project style guidelines (`npm run lint`)
- [ ] Code is properly formatted (`npm run format`)
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] All tests pass (`npm run test`)
- [ ] Extension builds successfully (`npm run build`)
- [ ] Commit messages follow conventional format
- [ ] Documentation updated (if needed)
- [ ] TASKS.md updated (if implementing a specific task)

### 📸 Screenshots/Demo
<!-- Include screenshots for UI changes or describe behavioral changes -->

### 🤔 Questions for Reviewers
<!-- Any specific areas you'd like reviewers to focus on -->

### 📚 Additional Context
<!-- Add any other context about the PR here -->

---

**Note for Reviewers:**
- Please check that all CI checks pass before approving
- Verify Chrome extension functionality if changes affect content scripts
- Test on at least one target platform (ChatGPT/Claude/Grok) for content script changes