import {
  Resolver,
  Mutation,
  InputType,
  Field,
  Arg,
  Ctx,
  ObjectType,
} from 'type-graphql';
import { MyContext } from 'src/types';
import { User } from '../entities/User';
import argon2 from 'argon2';

// Alternativ till att dekorera med flertalet @Arg
@InputType()
class UsernamePasswordInput {
  @Field()
  username: string;
  @Field()
  password: string;
}

// Ett objekt för att representera att något är fel med ett visst fält.
@ObjectType()
class FieldError {
  @Field()
  field: string;

  @Field()
  message: string;
}

// Används för att returnera error istället för att throwa dem.
// Objekt typer kan vi returnera ifrån våra mutationer
// Input typer använder vi för
@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  @Mutation(() => User)
  async register(
    @Arg('options') options: UsernamePasswordInput,
    @Ctx() { em }: MyContext
  ) {
    // Skapar ett hashat lösenord
    const hashedPassword = await argon2.hash(options.password);

    // Skapar själva användaren i databasen
    const user = em.create(User, {
      username: options.username,
      password: hashedPassword,
    });
    await em.persistAndFlush(user);
    return user;
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg('options') options: UsernamePasswordInput,
    @Ctx() { em }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(User, { username: options.username });

    // Gör första check om vi har en användare
    if (!user) {
      return {
        errors: [
          {
            field: 'username',
            message: "That username doesn't exist",
          },
        ],
      };
    }
    // Kolla så att lösenordet stämmer
    const valid = await argon2.verify(user.password, options.password);
    if (!valid) {
      return {
        errors: [
          {
            field: 'password',
            message: 'Incorrect password',
          },
        ],
      };
    }
    // Om allt stämmer returnera användaren.
    return {
      user,
    };
  }
}
