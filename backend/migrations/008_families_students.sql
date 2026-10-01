-- Family + student model. A parent account belongs to a family; a family has
-- one or more students; each student's teachers come from teacher_sections.
--
-- users.family_id already existed as TEXT (added by create_students.py during
-- the reverted per-student-login experiment) and was NULL on every row, so it
-- is converted in place to UUID rather than re-added.
--
-- Multi-statement: apply by hand, one statement at a time (apply_migration.py
-- cannot run this — see CLAUDE.md).

CREATE TABLE IF NOT EXISTS families (
    id         UUID PRIMARY KEY,
    school_id  UUID NOT NULL REFERENCES schools(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
    id         UUID PRIMARY KEY,
    school_id  UUID NOT NULL REFERENCES schools(id),
    family_id  UUID NOT NULL REFERENCES families(id),
    name       TEXT NOT NULL,
    section    TEXT NOT NULL,
    grade      INTEGER
);

CREATE INDEX IF NOT EXISTS students_family_id_idx ON students (family_id);

CREATE TABLE IF NOT EXISTS teacher_sections (
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id  UUID NOT NULL REFERENCES schools(id),
    section    TEXT NOT NULL,
    PRIMARY KEY (teacher_id, section)
);

CREATE INDEX IF NOT EXISTS teacher_sections_school_section_idx ON teacher_sections (school_id, section);

ALTER TABLE users ALTER COLUMN family_id TYPE UUID USING family_id::uuid;

ALTER TABLE users ADD CONSTRAINT users_family_id_fkey FOREIGN KEY (family_id) REFERENCES families(id);
