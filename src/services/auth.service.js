import crypto from "crypto";
import { v4 as uuid } from "uuid";
import jwt from "jsonwebtoken";
import argon from "argon2";
import { SignInBody, SignUpBody } from "../validations/User.js";
import prisma from "../prisma.js";
import { readFile } from "fs/promises";

async function createUser(data) {
  const { email, firstName, lastName, password, username, bio, photo } =
    SignUpBody.parse(data);

  let photoBuffer = null;

  if (photo != null) {
    photoBuffer = await readFile(photo.path);
  }

  const hashPass = await argon.hash(password);
  const hash = crypto.randomBytes(32).toString("hex");

  await prisma.user.create({
    data: {
      email,
      username,
      password: hashPass,
      hash,
      profile: { create: { firstName, lastName, bio, photo: photoBuffer } },
    },
  });
}

async function validatePassword(hash, pass) {
  return argon.verify(hash, pass);
}

async function findUserByEmail(email) {
  return await prisma.user.findUnique({
    where: { email },
  });
}

function createToken(id, hash) {
  const token = jwt.sign({ id }, hash, {
    subject: String(id),
  });

  return token;
}

async function signupService(data) {
  await createUser(data);
}

async function signinService(payload) {
  const { username, password } = SignInBody.parse(payload);

  const user = await findUserByEmail(username);

  if (user === null) throw new Error();

  const isPassMatch = await validatePassword(user.password, password);

  if (!isPassMatch) throw new Error();

  const token = createToken(user.id, user.hash);

  return token;
}

async function signoutService(id, aud) {
  await prisma.session.delete({
    where: {
      destination_userID: {
        destination: aud,
        userID: id,
      },
    },
  });
}

export { signupService, signinService, signoutService };
