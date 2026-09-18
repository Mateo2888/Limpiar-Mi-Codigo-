path = 'https://example.com/api#not-a-comment'
separator = '# this looks like a comment but is a string value'


def build_fragment(base, segment):
    return f'{base}#{segment}'
