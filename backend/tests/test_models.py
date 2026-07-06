import os
import sys
sys.path.insert(0, os.getcwd())

import uuid
from datetime import datetime, timedelta, UTC
from app.db.database import SessionLocal
import pytest
from app.db.base import Base
from app.models.user import User
from app.models.otp import OTPVerification 
from app.models.oauth import OAuthCredentials  

def test_database_models():
    db = SessionLocal()
    
    # Introspect column names dynamically so we never guess wrong
    otp_columns = [c.name for c in OTPVerification.__table__.columns]
    
    try:
        print("\n" + "="*60)
        print("DATABASE MODEL TESTS")
        print("="*60)
        print(f"📋 Detected OTP Columns: {otp_columns}")
        
        # Pre-Cleanup: Find the user first to get their ID for relational cleanup
        print("\n[PRE-CLEANUP] Clearing any leftover test data...")
        existing_user = db.query(User).filter(User.email == "test@example.com").first()
        if existing_user:
            db.query(OAuthCredentials).filter(OAuthCredentials.user_id == existing_user.id).delete()
            if "user_id" in otp_columns:
                db.query(OTPVerification).filter(OTPVerification.user_id == existing_user.id).delete()
            db.delete(existing_user)
            db.commit()
        print("✅ Pre-cleanup complete.")
        
        # Test 1: Create User
        print("\n[TEST 1] Create User")
        test_user = User(
            id=uuid.uuid4(),
            email="test@example.com",
            username="testuser",
            password_hash="hashed_password_here",
            role="user",
            status="active",
            email_verified=False
        )
        
        db.add(test_user)
        db.commit()
        print(f"✅ User created: {test_user.email}")
        
        # Test 2: Create OTPVerification with CORRECT column names
        print("\n[TEST 2] Create OTPVerification")
        
        # Build kwargs with the actual columns that exist in your schema
        otp_kwargs = {
            "user_id": test_user.id,
            "otp_type": "email_verification",  # ✅ CORRECT column name
            "otp_hash": "hashed_otp_value",    # ✅ CORRECT column name
            "expires_at": datetime.now(UTC) + timedelta(minutes=10)
        }

        otp = OTPVerification(**otp_kwargs)
        db.add(otp)
        db.commit()
        print("✅ OTP record created successfully.")
        
        # Test 3: Create OAuthCredentials
        print("\n[TEST 3] Create OAuthCredentials")
        oauth = OAuthCredentials(
            user_id=test_user.id,
            provider="google",
            provider_user_id="google-user-123"
        )
        
        db.add(oauth)
        db.commit()
        print(f"✅ OAuth credential created: {oauth.provider}")
        
        # Test 4: Query relationships
        print("\n[TEST 4] Test Relationships")
        user = db.query(User).filter(User.email == "test@example.com").first()
        print(f"✅ User oauth_credentials: {len(user.oauth_credentials)} linked")
        
        # Assertions for Pytest validation
        assert user is not None
        assert len(user.oauth_credentials) == 1
        
        # Cleanup
        print("\n[CLEANUP] Delete test data")
        db.query(OAuthCredentials).filter(OAuthCredentials.user_id == user.id).delete()
        if "user_id" in otp_columns:
            db.query(OTPVerification).filter(OTPVerification.user_id == user.id).delete()
        db.delete(user)
        db.commit()
        print("✅ Test data deleted cleanly.")
        
        print("\n" + "="*60)
        print("✅ ALL MODEL TESTS PASSED")
        print("="*60 + "\n")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error: {e}\n")
        import traceback
        traceback.print_exc()
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    test_database_models()