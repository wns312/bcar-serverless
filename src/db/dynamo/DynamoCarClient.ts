import { DynamoBaseClient } from "./DynamoBaseClient";

export class DynamoCarClient {
  baseClient: DynamoBaseClient;

  constructor(region: string) {
    this.baseClient = new DynamoBaseClient(region);
  }

  getCarByCarNum(tableName: string, carNum: string) {
    return this.baseClient.QueryItems({
      TableName: tableName,
      KeyConditionExpression: "PK = :p and SK = :s",
      ExpressionAttributeValues: {
        ":p": { S: `#CAR-${carNum}` },
        ":s": { S: `#CAR-${carNum}` },
      },
    });
  }

  getPostByCarNum(tableName: string, carNum: string) {
    return this.baseClient.QueryItems({
      TableName: tableName,
      KeyConditionExpression: "PK = :p and begins_with(SK, :s)",
      ExpressionAttributeValues: {
        ":p": { S: `#CAR-${carNum}` },
        ":s": { S: `#USER` },
      },
    });
  }

  getJoinedPost(tableName: string, indexName: string);
}
