import * as cdk from 'aws-cdk-lib';
import * as lambdanode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import * as apig from "aws-cdk-lib/aws-apigateway";
import { generateBatch } from "../shared/util";
import { movies, movieCasts } from "../seed/movies";

import { Construct } from 'constructs';

export class RestAPIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const moviesTable = new dynamodb.Table(this, "MoviesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Movies",
    });

    const movieCastsTable = new dynamodb.Table(this, "MovieCastTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: "actorName", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "MovieCast",
    });

    movieCastsTable.addLocalSecondaryIndex({
      indexName: "roleIx",
      sortKey: { name: "roleName", type: dynamodb.AttributeType.STRING },
    });

    new custom.AwsCustomResource(this, "moviesddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [moviesTable.tableName]: generateBatch(movies),
            [movieCastsTable.tableName]: generateBatch(movieCasts),  // Added
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"), //.of(Date.now().toString()),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [moviesTable.tableArn, movieCastsTable.tableArn],  // Includes movie cast
      }),
    });

    // Functions

    const appFn = (
      name: string,
      entry: string,
      environment: Record<string, string> = {}
    ) =>
      new lambdanode.NodejsFunction(this, name, {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: `${__dirname}/../lambdas/${entry}`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: moviesTable.tableName,
          REGION: this.region,
          ...environment,
        },
      });

    const getMovieByIdFn = appFn("GetMovieByIdFn", "getMovieById.ts");
    const getMovieCastMembersFn = appFn("GetMovieCastFn", "getMovieCastMembers.ts", {
      CAST_TABLE_NAME: movieCastsTable.tableName,
    });
    const addCastMemberFn = appFn("AddCastMember", 'addCastMember.ts', {
        CAST_TABLE_NAME: movieCastsTable.tableName,
      }
    );

    // Permissions

    moviesTable.grantReadData(getMovieByIdFn);
    movieCastsTable.grantReadData(getMovieCastMembersFn);
    moviesTable.grantReadData(getMovieCastMembersFn);
    moviesTable.grantReadData(addCastMemberFn);
    movieCastsTable.grantReadWriteData(addCastMemberFn)

    // REST API 

    const api = new apig.RestApi(this, "MoviesAPI", {
      description: "Movies API",
      deployOptions: {
        stageName: "dev",
      },
      // 👇 enable CORS
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowOrigins: ["*"],
      },
    });

    const moviesEndpoint = api.root.addResource("movies");
    const movieEndpoint = moviesEndpoint.addResource("{movieId}");
    movieEndpoint.addMethod("GET", new apig.LambdaIntegration(getMovieByIdFn));
    const movieCastEndpoint = movieEndpoint.addResource("cast");
    movieCastEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMovieCastMembersFn)
    );
    moviesEndpoint.addResource('cast').addMethod(
        "POST",
        new apig.LambdaIntegration(addCastMemberFn, { proxy: true })
    );

  }
}


