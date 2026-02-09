CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
  title,
  body,
  summary,
  content=entities,
  content_rowid=rowid,
  tokenize="porter unicode61 remove_diacritics 2"
);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS entities_fts_insert AFTER INSERT ON entities BEGIN
  INSERT INTO entities_fts(rowid, title, body, summary)
  VALUES (NEW.rowid, NEW.title, NEW.body, NEW.summary);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS entities_fts_update AFTER UPDATE ON entities BEGIN
  INSERT INTO entities_fts(entities_fts, rowid, title, body, summary)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.body, OLD.summary);
  INSERT INTO entities_fts(rowid, title, body, summary)
  VALUES (NEW.rowid, NEW.title, NEW.body, NEW.summary);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS entities_fts_delete BEFORE DELETE ON entities BEGIN
  INSERT INTO entities_fts(entities_fts, rowid, title, body, summary)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.body, OLD.summary);
END;
--> statement-breakpoint
INSERT INTO entities_fts(rowid, title, body, summary)
SELECT rowid, title, body, summary FROM entities;
