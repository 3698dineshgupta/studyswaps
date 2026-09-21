-- ============================================================
-- STUDENTMARKET — Live identity verification (camera capture)
-- Migration: 005_identity_verification.sql
--
-- * identity_verifications: one row per live capture, written ONLY by the server
--   (service role) after it has validated the image. Students can read their own
--   row; nothing lets a student insert, update status, or delete.
-- * identity-verifications: PRIVATE storage bucket. Objects live at
--     {auth user id}/{verification id}/identity_capture.jpg
--   Students may read only their own folder; reviewers/admins may read all.
--   No client-side insert/update/delete policies exist, so uploads go through the API.
-- Safe to run once on an existing database.
-- ============================================================

CREATE TABLE identity_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      verification_id UUID NOT NULL UNIQUE,          -- server-issued session id
        image_path TEXT NOT NULL,                      -- path inside the private bucket (never a URL)
          captured_at TIMESTAMPTZ NOT NULL,              -- server time when the capture was received
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'under_review', 'verified', 'rejected')),
                  challenge TEXT,                                -- random liveness prompt issued for this attempt
                    liveness_score NUMERIC(6,2),                   -- server-computed movement between frames
                      liveness_passed BOOLEAN NOT NULL DEFAULT FALSE,
                        mime_type TEXT,
                          file_size INTEGER,
                            reviewed_by UUID REFERENCES profiles(id),
                              reviewed_at TIMESTAMPTZ,
                                rejection_reason TEXT,
                                  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                                    );

                                    CREATE INDEX idx_identity_verifications_user_id ON identity_verifications(user_id);
                                    CREATE INDEX idx_identity_verifications_status ON identity_verifications(status);

                                    CREATE TRIGGER set_updated_at_identity_verifications
                                      BEFORE UPDATE ON identity_verifications
                                        FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

                                        -- Link a submitted verification request to exactly one live capture
                                        ALTER TABLE verification_requests
                                          ADD COLUMN identity_verification_id UUID UNIQUE REFERENCES identity_verifications(id) ON DELETE SET NULL;

                                          -- ---------- Row Level Security ----------
                                          ALTER TABLE identity_verifications ENABLE ROW LEVEL SECURITY;

                                          -- A student can read only their own record
                                          CREATE POLICY "identity_verifications_self_read" ON identity_verifications
                                            FOR SELECT TO authenticated USING (user_id = auth.uid());

                                            -- Reviewers / admins can read all records
                                            CREATE POLICY "identity_verifications_reviewer_read" ON identity_verifications
                                              FOR SELECT TO authenticated USING (
                                                  public.is_admin() OR public.has_role('VERIFICATION_REVIEWER')
                                                    );

                                                    -- No INSERT / UPDATE / DELETE policies: with RLS enabled that denies them for
                                                    -- clients. Belt and braces — also remove the table privileges themselves.
                                                    REVOKE ALL ON identity_verifications FROM anon;
                                                    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON identity_verifications FROM authenticated;
                                                    GRANT SELECT ON identity_verifications TO authenticated;

                                                    -- ---------- Private storage bucket ----------
                                                    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
                                                    VALUES ('identity-verifications', 'identity-verifications', FALSE, 5242880,
                                                            ARRAY['image/jpeg', 'image/png', 'image/webp'])
                                                            ON CONFLICT (id) DO UPDATE
                                                              SET public = FALSE,
                                                                    file_size_limit = 5242880,
                                                                          allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

                                                                          CREATE POLICY "identity_images_self_read" ON storage.objects
                                                                            FOR SELECT TO authenticated USING (
                                                                                bucket_id = 'identity-verifications'
                                                                                    AND (storage.foldername(name))[1] = auth.uid()::text
                                                                                      );

                                                                                      CREATE POLICY "identity_images_reviewer_read" ON storage.objects
                                                                                        FOR SELECT TO authenticated USING (
                                                                                            bucket_id = 'identity-verifications'
                                                                                                AND (public.is_admin() OR public.has_role('VERIFICATION_REVIEWER'))
                                                                                                  );
                                                                                                  