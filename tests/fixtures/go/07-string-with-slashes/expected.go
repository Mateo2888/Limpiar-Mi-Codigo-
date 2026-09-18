package api

const path = "https://example.com/api // not a comment"
const separator = "// this looks like a comment but is a string value"

func BuildFragment(base, segment string) string {
	return base + "//" + segment
}
