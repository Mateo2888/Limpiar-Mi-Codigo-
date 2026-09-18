class UserService
{
    User GetUser(string id)
    {
        var user = db.FindById(id);

        if (user == null)
        {
            throw new NotFoundException();
        }

        return user;
    }
}
