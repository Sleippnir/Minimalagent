# Interview Service Refactoring Plan: Hexagonal Architecture

## Executive Summary

This document outlines a step-by-step plan to refactor the interview service from a traditional layered architecture to hexagonal architecture (ports & adapters pattern). The goal is to improve testability, maintainability, and flexibility while minimizing risk of breaking existing functionality.

## Current Architecture Analysis

### Strengths

- Simple and functional
- Fast development iteration
- Clear separation between frontend, API, and background processing
- Working end-to-end pipeline

### Pain Points

- **Tight Coupling**: Business logic directly depends on infrastructure (Supabase, subprocess launching)
- **Mixed Concerns**: HTTP handlers contain business logic and infrastructure code
- **Testing Challenges**: Hard to unit test without external dependencies
- **Change Resistance**: Modifications require touching multiple layers
- **Infrastructure Lock-in**: Difficult to swap databases, bot systems, or LLM providers

### Coupling Issues Identified

1. **interview_api.py**: HTTP routes directly launch subprocesses and access database
2. **background_evaluator.py**: Polls database directly, tightly coupled to Supabase
3. **Context Service**: Business logic mixed with data access patterns
4. **Bot Launching**: Infrastructure concern embedded in API layer

## Hexagonal Architecture Benefits

### For This Project

- **Testability**: Mock external services for unit testing
- **Flexibility**: Swap LLM providers, databases, or bot systems
- **Maintainability**: Clear boundaries between business logic and infrastructure
- **Evolvability**: Add new features without touching existing code

### Trade-offs

- **Complexity**: More files and abstractions
- **Development Time**: Initial investment required
- **Learning Curve**: Team needs to understand the pattern

## Target Architecture

```text
interview/
├── domain/                    # Business Logic Layer
│   ├── entities/             # Core business objects
│   │   ├── interview.py      # Interview, Candidate, Job
│   │   ├── evaluation.py     # Evaluation, Score
│   │   └── transcript.py     # Transcript, Turn
│   ├── services/             # Business services
│   │   ├── interview_service.py
│   │   ├── evaluation_service.py
│   │   └── bot_service.py
│   └── ports/                # Interfaces (contracts)
│       ├── repositories/     # Data access interfaces
│       ├── external/         # External service interfaces
│       └── events/           # Event publishing interfaces
├── application/              # Application Layer
│   ├── use_cases/            # Application use cases
│   │   ├── get_interview.py
│   │   ├── launch_bot.py
│   │   ├── submit_transcript.py
│   │   └── evaluate_interview.py
│   ├── dto/                  # Data Transfer Objects
│   └── handlers/             # Application event handlers
├── infrastructure/           # Infrastructure Layer
│   ├── api/                  # HTTP Adapters
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── dto/              # HTTP request/response models
│   ├── repositories/         # Data Access Adapters
│   │   ├── supabase/
│   │   └── in_memory/        # For testing
│   ├── external/             # External Service Adapters
│   │   ├── bot_launcher.py
│   │   ├── llm_client.py
│   │   └── queue_client.py
│   └── config/               # Infrastructure configuration
└── bootstrap/                # Application Composition
    ├── container.py          # Dependency injection
    └── main.py               # Application entry point
```

## Refactoring Strategy

### Phase 1: Preparation (Non-Breaking)

#### Step 1.1: Create New Structure

```bash
mkdir -p interview/domain/{entities,services,ports/{repositories,external,events}}
mkdir -p interview/application/{use_cases,dto,handlers}
mkdir -p interview/infrastructure/{api/{routes,middleware,dto},repositories/{supabase,in_memory},external,config}
mkdir -p interview/bootstrap
```

#### Step 1.2: Extract Core Entities

- Move business objects to `domain/entities/`
- Ensure they contain only business logic, no external dependencies
- Add validation and business rules

#### Step 1.3: Define Ports (Interfaces)

- Create abstract base classes for all external dependencies
- Define repository interfaces
- Define external service interfaces
- Define event publishing interfaces

#### Step 1.4: Setup Dependency Injection

- Create `bootstrap/container.py` for wiring dependencies
- Use protocols or ABC for interface definitions
- Support multiple implementations (real vs test)

#### Step 1.5: Comprehensive Test Suite

- Unit tests for all business logic
- Integration tests for current functionality
- End-to-end tests for critical paths

### Phase 2: Core Business Logic (Breaking Changes)

#### Step 2.1: Extract Domain Services

- Move business logic from context services to domain services
- Implement using only domain entities and ports
- Ensure no external dependencies

#### Step 2.2: Create Application Use Cases

- Extract orchestration logic from HTTP handlers
- Use domain services through ports
- Return domain objects, not infrastructure-specific data

#### Step 2.3: Implement Repository Adapters

- Create Supabase implementations of repository ports
- Create in-memory implementations for testing
- Ensure adapters only translate between domain and infrastructure

#### Step 2.4: Implement External Service Adapters

- Bot launcher adapter
- LLM client adapter
- Queue client adapter
- Event publisher adapter

### Phase 3: HTTP Layer Refactoring

#### Step 3.1: Refactor API Routes

- Routes become thin adapters calling use cases
- Convert HTTP requests to domain DTOs
- Convert domain responses to HTTP responses
- Remove business logic from routes

#### Step 3.2: Update Middleware

- Ensure CORS and other middleware work with new structure
- Add request logging and error handling

#### Step 3.3: Update Data Transfer Objects

- Create HTTP-specific DTOs separate from domain objects
- Handle serialization/deserialization

### Phase 4: Background Services

#### Step 4.1: Refactor Background Evaluator

- Extract to application use case
- Use dependency injection for all external services
- Make polling mechanism configurable

#### Step 4.2: Event-Driven Architecture

- Replace polling with event-driven processing
- Implement event publishing for status changes
- Add event handlers for automated workflows

### Phase 5: Migration & Validation

#### Step 5.1: Parallel Implementation

- Run old and new implementations side-by-side
- Use feature flags to switch between implementations
- Compare outputs for consistency

#### Step 5.2: Gradual Migration

- Start with read-only operations
- Migrate write operations one by one
- Keep old implementation as fallback

#### Step 5.3: Database Migration

- Ensure schema changes are backward compatible
- Add migration scripts for any required changes
- Test data integrity during migration

## Dependency Management Strategy

### 1. Interface Segregation

- **Before**: Concrete classes directly imported

```python
from interview.context_service import ContextService
```

- **After**: Interfaces with dependency injection

```python
from interview.domain.ports.repositories import IInterviewRepository

class InterviewService:
    def __init__(self, interview_repo: IInterviewRepository):
        self.interview_repo = interview_repo
```

### 2. Configuration Management

- **Environment-Specific Config**: Different implementations per environment
- **Feature Flags**: Gradual rollout of new features
- **Dependency Injection Container**: Centralized wiring

### 3. Backward Compatibility

- **API Contracts**: Keep existing HTTP APIs unchanged
- **Database Schema**: Non-breaking schema changes
- **Gradual Migration**: Old and new code coexist

## Testing Strategy

### 1. Unit Testing

- **Domain Layer**: Test business logic with mocked dependencies
- **Application Layer**: Test use cases with stubbed ports
- **Infrastructure Layer**: Test adapters in isolation

### 2. Integration Testing

- **Repository Tests**: Test against real database (but isolated)
- **External Service Tests**: Test with test doubles for external APIs
- **API Tests**: Test HTTP endpoints with mocked business logic

### 3. End-to-End Testing

- **Critical Paths**: Interview creation → bot launch → transcript → evaluation
- **Data Consistency**: Ensure old and new implementations produce same results
- **Performance**: Monitor for regressions

### 4. Test Data Management

- **Factories**: Create test data using domain objects
- **Fixtures**: Reusable test data setups
- **Cleanup**: Ensure tests don't leave persistent state

## Risk Assessment & Mitigation

### High Risk Areas

1. **Database Operations**: Most likely to break existing functionality
2. **Bot Launching**: External process management
3. **Real-time Communication**: WebRTC connections

### Mitigation Strategies

1. **Feature Flags**: Switch between old/new implementations
2. **Circuit Breakers**: Fail gracefully to old implementation
3. **Monitoring**: Comprehensive logging and metrics
4. **Rollback Plan**: Quick reversion to old code

### Success Metrics

- **Zero Downtime**: No service interruptions during migration
- **Data Integrity**: No data loss or corruption
- **Performance**: No degradation in response times
- **Test Coverage**: >90% coverage for new code

## Implementation Timeline

### Week 1-2: Preparation

- Create new structure
- Extract entities and define ports
- Setup dependency injection
- Create comprehensive test suite

### Week 3-4: Core Refactoring

- Implement domain services
- Create use cases
- Implement adapters
- Refactor HTTP layer

### Week 5-6: Migration & Validation

- Parallel implementation
- Gradual migration
- Extensive testing
- Performance monitoring

### Week 7-8: Cleanup & Optimization

- Remove old code
- Performance optimization
- Documentation updates
- Team training

## Success Criteria

### Functional Requirements

- ✅ All existing APIs work unchanged
- ✅ All business logic produces same results
- ✅ All integrations (Supabase, bots, LLMs) work
- ✅ Performance meets or exceeds current levels

### Quality Requirements

- ✅ >90% test coverage for new code
- ✅ Clear separation of concerns
- ✅ Easy to test and maintain
- ✅ Flexible for future changes

### Operational Requirements

- ✅ Zero downtime during migration
- ✅ Easy to deploy and rollback
- ✅ Comprehensive monitoring and logging
- ✅ Clear documentation for team

## Rollback Plan

### Immediate Rollback (< 1 hour)

1. Switch feature flags to use old implementation
2. Deploy old code version
3. Verify system functionality
4. Monitor for 24 hours

### Full Rollback (< 4 hours)

1. Revert git branch
2. Deploy previous version
3. Restore database backup if needed
4. Update documentation

### Partial Rollback (< 2 hours)

1. Keep new structure but use old implementations
2. Gradually migrate individual components back
3. Maintain hybrid approach until stable

## Conclusion

This refactoring will significantly improve the system's maintainability, testability, and flexibility. While it requires substantial upfront investment, the long-term benefits justify the effort. The incremental approach minimizes risk and allows for continuous validation throughout the process.

**Key Success Factors:**

- Comprehensive testing at every step
- Parallel implementation with feature flags
- Clear separation between business and infrastructure concerns
- Team alignment on architectural vision
- Gradual migration with rollback capabilities

The new architecture will position the system for future growth and make it much easier to add new features, swap implementations, and maintain code quality.

