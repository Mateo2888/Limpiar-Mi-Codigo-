async function getUser(id: string) {
  const user = await db.users.findById(id);

  if (!user) {
    return null;
  }

  return user;
}
