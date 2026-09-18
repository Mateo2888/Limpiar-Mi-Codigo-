class CacheUtil
{
    // Workaround: en .NET Framework 4.7 ConcurrentDictionary no expone Count con O(1), se lleva un contador aparte.
    int Count(ConcurrentDictionary<string, string> map)
    {
        return map.Count;
    }
}
