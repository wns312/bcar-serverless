
import {
  BatchWriteItemCommand,
  BatchWriteItemCommandInput,
  DeleteItemCommand,
  DeleteItemCommandInput,
  DeleteRequest,
  DescribeTableCommand,
  DynamoDBClient,
  ExecuteStatementCommand,
  ExecuteStatementCommandInput,
  PutItemCommand,
  PutItemCommandInput,
  PutRequest,
  QueryCommand,
  QueryCommandInput,
  ScanCommand,
  ScanCommandInput,
} from "@aws-sdk/client-dynamodb";
import { chunk } from "../../utils/index"

export class DynamoBaseClient {
  client: DynamoDBClient;

  constructor(region: string) {
    this.client = new DynamoDBClient({ region }); // 'ap-northeast-2'
  }

  async describeTable(tableName: string) {
    const command = new DescribeTableCommand({ TableName: tableName });
    return this.client.send(command);
  }

  async putItem(input: PutItemCommandInput) {
    return this.client.send(new PutItemCommand(input));
  }

  async scanItems(input: ScanCommandInput) {
    return this.client.send(new ScanCommand(input));
  }

  async queryItems(input: QueryCommandInput) {
    return this.client.send(new QueryCommand(input));
  }

  async executeStatement(input: ExecuteStatementCommandInput) {
    return this.client.send(new ExecuteStatementCommand(input))
  }

  async batchWriteItem(input: BatchWriteItemCommandInput) {
    return this.client.send(new BatchWriteItemCommand(input))
  }

  async deleteItems(input: DeleteItemCommandInput) {
    return this.client.send(new DeleteItemCommand(input))
  }

  async batchPutItems(tableName: string, ...putRequestInputs: PutRequest[]) {
    const input = putRequestInputs.map(input=>({ PutRequest: input }))
    const responses = chunk(input, 25).map(putRequests => {
      return this.batchWriteItem({
        RequestItems: {
          [tableName]: putRequests
        }
      });
    })
    return Promise.all(responses)
  }

  async batchDeleteItems(tableName: string, ...deleteRequestInputs: DeleteRequest[]) {
    const input = deleteRequestInputs.map(input=>({ DeleteRequest: input }))
    const responses = chunk(input, 25).map(putRequests => {
      return this.batchWriteItem({
        RequestItems: {
          [tableName]: putRequests
        }
      });
    })
    return Promise.all(responses)
  }
}
