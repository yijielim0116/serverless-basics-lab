import { marshall, marshallOptions, unmarshallOptions } from "@aws-sdk/util-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Movie } from "./types";

export const generateMovieItem = (movie: Movie) => {
  return {
    PutRequest: {
      Item: marshall(movie),
    },
  };
};

export const generateBatch = (data: Movie[]) => {
  return data.map((e) => {
    return generateMovieItem(e);
  });
};

export function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshall : marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshall:  unmarshallOptions = {
    wrapNumbers: false,
  };
  return DynamoDBDocumentClient.from(ddbClient, {
    marshallOptions: marshall, unmarshallOptions: unmarshall
  });
}
