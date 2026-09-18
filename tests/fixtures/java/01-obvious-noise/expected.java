class UserService {
    User getUser(String id) {
        User user = db.findById(id);

        if (user == null) {
            throw new NotFoundException();
        }

        return user;
    }
}
