-- Two more choices for a shared shelf, beside "Include my notes": whether
-- visitors see the owner's star ratings, and whether they see how far the
-- owner has read. Both start on, which is how every shared shelf already
-- looks, so nothing changes until someone switches one off. Adds two
-- columns to users; nothing else changes.
ALTER TABLE "users"
  ADD COLUMN "share_ratings" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "share_progress" BOOLEAN NOT NULL DEFAULT true;
