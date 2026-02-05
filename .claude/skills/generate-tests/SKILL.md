---
name: generate-tests
description: Generates comprehensive unit tests for a function or component
---

# Test Generation Skill

Generate comprehensive tests following these principles:

## Test Structure

Use the **Arrange-Act-Assert** pattern:
```typescript
it('should [expected behavior]', () => {
  // Arrange - Set up test data and mocks

  // Act - Execute the code under test

  // Assert - Verify the results
});
```

## Coverage Categories

1. **Happy Path**: Normal, expected inputs and flows
2. **Edge Cases**: Empty inputs, null/undefined, boundary values
3. **Error Cases**: Invalid inputs, network failures, exceptions
4. **Integration**: Interactions between components

## Naming Convention

Use descriptive test names:
- `should return empty array when input is null`
- `should throw ValidationError when email is invalid`
- `should call onSubmit with form data when form is valid`

## Mocking Strategy

- Mock external dependencies (APIs, databases)
- Use spies for callback verification
- Reset mocks between tests

## Output

Provide complete, runnable test files with:
- All necessary imports
- Proper test grouping with `describe` blocks
- Setup/teardown as needed
- Clear assertions with meaningful error messages
