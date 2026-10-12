import { Handler } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { createDDbDocClient, response } from "../shared/util";

const ddbDocClient = createDDbDocClient();

export const handler: Handler = async (event, context) => {
  try {
    console.log("Event: ", JSON.stringify(event));
    const parameters = event?.queryStringParameters;
    const movieId = parameters ? parseInt(parameters.movieId) : undefined;

    if (!movieId) {
      return response(400, { message: "Missing movie Id" })

    }
    const commandOutput = await ddbDocClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { id: movieId },
      })
    );
    console.log("GetCommand response: ", commandOutput);
    if (!commandOutput.Item) {
      return response(400, { message: "Invalid movie Id" })
    }
    const body = {
      data: commandOutput.Item,
    };
    return response(200, body)
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return response(500, { error: (error as Error).message })
  }
};
