# Workaround: en Python 3.8 no existe functools.cache, se usa lru_cache sin maxsize.
def cached(fn):
    return lru_cache(maxsize=None)(fn)
