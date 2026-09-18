// Workaround: Safari < 16 no soporta structuredClone, se usa JSON como fallback.
function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
