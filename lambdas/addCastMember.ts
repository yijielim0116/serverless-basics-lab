import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import {
  isResponse,
  createDDbDocClient,
  parseJsonObject,
  response,
} from "../shared/util";
import { MovieCast } from "../shared/types";
import Ajv from "ajv";   // NEW
import schema from "../shared/types.schema.json";   // NEW
 // NEW
const ajv = new Ajv();
const isValidMovieCastPayload = ajv.compile<MovieCast>(
  schema.definitions["MovieCast"] || {}
);

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandler = async (
  event: APIGatewayProxyEvent,
  context
): Promise<APIGatewayProxyResult> => {
  try {
    console.log("Event: ", JSON.stringify(event));
    const body = parseJsonObject(event);
    if (isResponse(body)) return body;
    // NEW
    if (!isValidMovieCastPayload(body)) {
      return response(400, {
        message: "Incorrect type. Must match the MovieCast schema",
        schema: schema.definitions["MovieCast"],
      });
    }
    await ddbDocClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            ConditionCheck: {
              TableName: process.env.TABLE_NAME,
              Key: { id: body.movieId },
              ConditionExpression: "attribute_exists(id)",
            },
          },
          {
            Put: {
              TableName: process.env.CAST_TABLE_NAME,
              Item: body,
            },
          },
        ],
      })
    );
    return response(201, { message: "Cast member added", data: body });
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return response(500, error as Error);
  }
};
