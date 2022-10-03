import { APIGatewayEvent, Context } from "aws-lambda";

exports.hello = async (
  event: APIGatewayEvent,
  context: Context,
  // callback: Function
) => {
  console.log(process.env.MESSAGE);
  
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: "Go Serverless v3.0! Your function executed successfully!",
        input: event,
      },
      null,
      2
    ),
  };
};
