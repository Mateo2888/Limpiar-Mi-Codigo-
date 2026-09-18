function loadConfig(path: string) {
  // TODO: validate this later
  const raw = readFileSync(path, 'utf8');

  // FIXME: check this edge case
  const parsed = JSON.parse(raw);

  // Gets the settings object
  const settings = parsed.settings;

  return settings;
}
