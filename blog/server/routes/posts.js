const express = require('express');
const router = express.Router();
const { getDB } = require('../db/database');
const slugify = require('slugify');

// GET /api/posts - List all published posts
router.get('/', (req, res) => {
  const db = getDB();
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const tag = req.query.tag;

  let countSql = `SELECT COUNT(*) as total FROM posts WHERE published = 1`;
  let sql = `
    SELECT p.*, GROUP_CONCAT(t.name) as tags
    FROM posts p
    LEFT JOIN post_tags pt ON p.id = pt.post_id
    LEFT JOIN tags t ON pt.tag_id = t.id
    WHERE p.published = 1
  `;

  if (tag) {
    const tagFilter = ` AND p.id IN (SELECT pt2.post_id FROM post_tags pt2 JOIN tags t2 ON pt2.tag_id = t2.id WHERE t2.slug = ?)`;
    countSql += tagFilter;
    sql += tagFilter;
  }

  sql += ` GROUP BY p.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;

  const total = tag
    ? db.prepare(countSql).get(tag).total
    : db.prepare(countSql).get().total;

  const posts = tag
    ? db.prepare(sql).all(tag, limit, offset)
    : db.prepare(sql).all(limit, offset);

  res.json({
    posts: posts.map(p => ({
      ...p,
      tags: p.tags ? p.tags.split(',') : []
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit)
  });
});

// GET /api/posts/:slug - Get single post
router.get('/:slug', (req, res) => {
  const db = getDB();
  const post = db.prepare(`
    SELECT p.*, GROUP_CONCAT(t.name) as tags
    FROM posts p
    LEFT JOIN post_tags pt ON p.id = pt.post_id
    LEFT JOIN tags t ON pt.tag_id = t.id
    WHERE p.slug = ?
    GROUP BY p.id
  `).get(req.params.slug);

  if (!post) return res.status(404).json({ error: 'Post not found' });

  post.tags = post.tags ? post.tags.split(',') : [];
  res.json(post);
});

// POST /api/posts - Create post (admin)
router.post('/', (req, res) => {
  const db = getDB();
  const { title, content, excerpt, cover_image, published, tags } = req.body;
  const slug = slugify(title, { lower: true, strict: true });

  const result = db.prepare(`
    INSERT INTO posts (title, slug, content, excerpt, cover_image, published)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title, slug, content, excerpt || '', cover_image || '', published ? 1 : 0);

  // Handle tags
  if (tags && tags.length > 0) {
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)');
    const insertPostTag = db.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)');
    
    for (const tagName of tags) {
      const tagSlug = slugify(tagName, { lower: true, strict: true });
      insertTag.run(tagName, tagSlug);
      const tag = db.prepare('SELECT id FROM tags WHERE slug = ?').get(tagSlug);
      if (tag) insertPostTag.run(result.lastInsertRowid, tag.id);
    }
  }

  res.status(201).json({ id: result.lastInsertRowid, slug });
});

// PUT /api/posts/:id - Update post (admin)
router.put('/:id', (req, res) => {
  const db = getDB();
  const { title, content, excerpt, cover_image, published, tags } = req.body;

  db.prepare(`
    UPDATE posts SET title=?, content=?, excerpt=?, cover_image=?, published=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(title, content, excerpt, cover_image, published ? 1 : 0, req.params.id);

  // Update tags
  if (tags) {
    db.prepare('DELETE FROM post_tags WHERE post_id = ?').run(req.params.id);
    const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)');
    const insertPostTag = db.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)');
    
    for (const tagName of tags) {
      const tagSlug = slugify(tagName, { lower: true, strict: true });
      insertTag.run(tagName, tagSlug);
      const tag = db.prepare('SELECT id FROM tags WHERE slug = ?').get(tagSlug);
      if (tag) insertPostTag.run(req.params.id, tag.id);
    }
  }

  res.json({ success: true });
});

// DELETE /api/posts/:id - Delete post (admin)
router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
