async def get_user(user_id):
    # Verificar si el usuario existe
    user = await db.users.find_by_id(user_id)

    # Si no existe, retornar error
    if not user:
        return None

    # Devolver el usuario
    return user
