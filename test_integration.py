#!/usr/bin/env python3
"""
Interview Container Test
Tests that all imports and basic functionality work
"""

import sys
import os

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    """Test that all main classes can be imported"""
    try:
        from interview import InterviewBot, InterviewEvaluator, ContextService, InterviewConfig
        print("✓ Main classes imported successfully")
        return True
    except ImportError as e:
        print(f"✗ Import error: {e}")
        return False

def test_config():
    """Test configuration loading"""
    try:
        from interview.config import InterviewConfig
        InterviewConfig.validate()
        print("✓ Configuration validated")
        return True
    except Exception as e:
        print(f"✗ Configuration error: {e}")
        return False

def test_services():
    """Test service initialization"""
    try:
        from interview.context_service_integration import ContextService
        from interview.evaluator_service import InterviewEvaluator

        # These will fail without proper Supabase setup, but imports should work
        print("✓ Services can be imported")
        return True
    except ImportError as e:
        print(f"✗ Service import error: {e}")
        return False

def main():
    """Run all tests"""
    print("Testing Interview Container Integration...")
    print("=" * 50)

    tests = [
        ("Imports", test_imports),
        ("Configuration", test_config),
        ("Services", test_services)
    ]

    passed = 0
    total = len(tests)

    for test_name, test_func in tests:
        print(f"\nRunning {test_name} test...")
        if test_func():
            passed += 1

    print("\n" + "=" * 50)
    print(f"Tests passed: {passed}/{total}")

    if passed == total:
        print("🎉 All tests passed! Interview container is ready.")
    else:
        print("⚠️  Some tests failed. Check the errors above.")

if __name__ == "__main__":
    main()