def load_config(path):
    # TODO: validate this later
    raw = read_file(path)

    # FIXME: check this edge case
    parsed = json.loads(raw)

    settings = parsed["settings"]

    return settings
