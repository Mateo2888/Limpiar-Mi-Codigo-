async def get_user(user_id):
    user = await db.users.find_by_id(user_id)

    if not user:
        return None

    return user
