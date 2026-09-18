package user

func GetUser(id string) (*User, error) {
	user, err := db.FindByID(id)
	if err != nil {
		return nil, err
	}

	if user == nil {
		return nil, ErrNotFound
	}

	return user, nil
}
