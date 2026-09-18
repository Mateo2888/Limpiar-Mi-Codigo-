package cache

// Workaround: en Go 1.20 sync.Map no expone Len(), se lleva un contador aparte.
func (c *Cache) Len() int {
	return int(c.count.Load())
}
