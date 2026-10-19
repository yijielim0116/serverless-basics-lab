import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { Movie } from "../shared/types";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { createDDbDocClient, response, parseId } from "../shared/util";

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
  context
): Promise<APIGatewayProxyResult> => {
  try {
    console.log("Event: ", JSON.stringify(event));
    const movieId = parseId(event.pathParameters?.movieId);
    if (movieId === undefined) {
      return response(400, { message: "movieID must be a positive integer" });
    }
    const commandOutput = await ddbDocClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { id: movieId },
      })
    );
    console.log("GetCommand response: ", commandOutput);
    if (!commandOutput.Item) {
      return response(404, { message: `No movie with ID ${movieId}` });
    }
    const body = {
      data: commandOutput.Item as Movie,
    };
    return response(200, body);
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return response(500, { message: 'Internal server error' });
  }
};
