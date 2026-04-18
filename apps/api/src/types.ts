export type User = {
  id: string;
  name: string;
  username: string;
  email: string;
};

export type AuthEnv = {
  Variables: {
    user: User;
  };
};
