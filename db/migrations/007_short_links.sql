-- التحديث 07: روابط دعوات مختصرة للإرسال عبر واتساب (/d/<رمز>)
-- الرمز المختصر يوجّه إلى رابط الدعوة الكامل؛ يتجدد مع إعادة الإصدار فيُبطل الرابط القديم
ALTER TABLE invitations ADD COLUMN short_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_short_code ON invitations(short_code) WHERE short_code IS NOT NULL;
