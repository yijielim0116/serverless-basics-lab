import { marshall, marshallOptions, unmarshallOptions } from "@aws-sdk/util-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Movie, MovieCast } from "./types";

type Entity = Movie | MovieCast;  // NEW
export const generateItem = (entity: Entity) => {
  return {
    PutRequest: {
      Item: marshall(entity),
    },
  };
};

export const generateBatch = (data: Entity[]) => {
  return data.map((e) => {
    return generateItem(e);
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

export const response = (
  statusCode: number,
  body: object,
  headers: Record<string, string> = {},
): Record<string, any> => ({
  statusCode,
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
