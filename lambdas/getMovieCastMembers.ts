import {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { QueryCommand, QueryCommandInput, GetCommand } from "@aws-sdk/lib-dynamodb";
import { MovieCast, MovieCastResponse } from "../shared/types";
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
    const queryParams = event.queryStringParameters;
    let commandInput: QueryCommandInput = {
      TableName: process.env.CAST_TABLE_NAME,
      KeyConditionExpression: "movieId = :m",
      ExpressionAttributeValues: {
        ":m": movieId,
      },
    };
    if (queryParams && "roleName" in queryParams) {
      commandInput = {
        ...commandInput,
        IndexName: "roleIx",
        KeyConditionExpression: "movieId = :m and begins_with(roleName, :r) ",
        ExpressionAttributeValues: {
          ":m": movieId,
          ":r": queryParams.roleName,
        },
      };
    } else if (queryParams && "actorName" in queryParams) {
      commandInput = {
        ...commandInput,
        KeyConditionExpression: "movieId = :m and begins_with(actorName, :a) ",
        ExpressionAttributeValues: {
          ":m": movieId,
          ":a": queryParams.actorName,
        },
      };
    }
    const commandOutput = await ddbDocClient.send(
      new QueryCommand(commandInput)
    );
    if (!commandOutput.Items || commandOutput.Items.length === 0 ) {
      return response(404, { message: `No data for movie ${movieId}` });
    }
    let result: MovieCastResponse = {
      cast: commandOutput.Items as MovieCast[],
    };

    if (queryParams && queryParams.facts === "true") {
      const movieCommandOutput = await ddbDocClient.send(
        new GetCommand({
          TableName: process.env.TABLE_NAME,
          Key: { id: movieId },
        })
      );
      result = {
        ...result,
        movie: {
          title: movieCommandOutput.Item?.title,
          overview: movieCommandOutput.Item?.overview,
          genre_ids: movieCommandOutput.Item?.genre_ids,
        },
      };
    }
    return response(200, result);
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return response(500, { message: 'Internal server error' });
  }
};
