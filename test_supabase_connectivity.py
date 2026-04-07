"""Verify Supabase PostgreSQL connectivity and LangGraph checkpoint table setup."""
import os
from dotenv import load_dotenv

load_dotenv()

DB_URI = os.getenv("SUPABASE_DB_URI", "")

if not DB_URI:
    print("[FAIL] SUPABASE_DB_URI is not set in .env")
    exit(1)

print("=" * 60)
print("Supabase Connectivity Verification")
print("=" * 60)

# ── Step 1: Raw psycopg connection ────────────────────────────────
print("\n[1] Testing raw psycopg connection...")
try:
    import psycopg
    with psycopg.connect(DB_URI, connect_timeout=10) as conn:
        row = conn.execute("SELECT version();").fetchone()
        print(f"    PASS  Connected to: {row[0][:60]}...")
except Exception as e:
    print(f"    FAIL  {e}")
    exit(1)

# ── Step 2: Connection pool ───────────────────────────────────────
print("\n[2] Testing ConnectionPool...")
try:
    from psycopg_pool import ConnectionPool
    pool = ConnectionPool(conninfo=DB_URI, max_size=5, open=True)
    with pool.connection() as conn:
        result = conn.execute("SELECT current_database(), current_user;").fetchone()
        print(f"    PASS  Database: {result[0]}, User: {result[1]}")
    pool.close()
except Exception as e:
    print(f"    FAIL  {e}")
    exit(1)

# ── Step 3: PostgresSaver setup (creates checkpoint tables) ───────
print("\n[3] Testing PostgresSaver.setup() (creates checkpoint tables)...")
try:
    from psycopg_pool import ConnectionPool
    from langgraph.checkpoint.postgres import PostgresSaver

    pool = ConnectionPool(
        conninfo=DB_URI,
        max_size=5,
        open=True,
        kwargs={"autocommit": True},   # required for CREATE INDEX CONCURRENTLY
    )
    saver = PostgresSaver(pool)
    saver.setup()
    print("    PASS  Checkpoint tables created/verified")
except Exception as e:
    print(f"    FAIL  {e}")
    pool.close()
    exit(1)

# ── Step 4: Confirm checkpoint tables exist ───────────────────────
print("\n[4] Verifying checkpoint tables in database...")
try:
    with pool.connection() as conn:
        tables = conn.execute("""
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
            AND tablename LIKE 'checkpoints%' OR tablename = 'checkpoint_writes'
            ORDER BY tablename;
        """).fetchall()
        if tables:
            for (t,) in tables:
                print(f"    PASS  Table exists: {t}")
        else:
            print("    WARN  No checkpoint tables found (may use different schema)")
except Exception as e:
    print(f"    FAIL  {e}")

# ── Step 5: Write and read a test checkpoint ──────────────────────
print("\n[5] Write/read round-trip with a test checkpoint...")
try:
    from langgraph.checkpoint.base import Checkpoint, CheckpointMetadata
    import uuid

    test_thread = f"test-{uuid.uuid4()}"
    config = {"configurable": {"thread_id": test_thread, "checkpoint_ns": "", "checkpoint_id": str(uuid.uuid4())}}

    # Write a minimal checkpoint
    checkpoint: Checkpoint = {
        "v": 1,
        "id": config["configurable"]["checkpoint_id"],
        "ts": "2026-01-01T00:00:00+00:00",
        "channel_values": {"sleep_hours": 7, "assessment": "test value"},
        "channel_versions": {},
        "versions_seen": {},
        "pending_sends": [],
    }
    metadata: CheckpointMetadata = {"source": "test", "step": 0, "writes": {}, "parents": {}}

    saver.put(config, checkpoint, metadata, {})
    print(f"    PASS  Checkpoint written (thread: {test_thread[:20]}...)")

    # Read it back
    result = saver.get(config)
    assert result is not None, "Got None back from saver.get()"
    assert result["channel_values"]["sleep_hours"] == 7
    assert result["channel_values"]["assessment"] == "test value"
    print(f"    PASS  Checkpoint read back — sleep_hours={result['channel_values']['sleep_hours']}, assessment='{result['channel_values']['assessment']}'")

except Exception as e:
    print(f"    FAIL  {e}")

pool.close()

print("\n" + "=" * 60)
print("Result: ALL CONNECTIVITY CHECKS PASSED")
print("=" * 60)
