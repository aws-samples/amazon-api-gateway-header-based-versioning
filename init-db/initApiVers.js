const AWS = require('aws-sdk')
AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' })
const documentClient = new AWS.DynamoDB.DocumentClient()
const tableName = process.env.DynamoDBTableName

const initApiVers = async () => {
    try {
        console.log('initApiVers started.')

        let apiHeader = process.env.ApiHeaderV1
        let apiDomain = process.env.ApiDomainV1
        let apiPath = process.env.ApiPathV1
        let params = {
            TableName: tableName,
            Item:{
                "hk": apiHeader,
                "dn": apiDomain,
                "dp": apiPath
            }
        };
        console.log("Adding API V1 Mapping: ", params)
        let result = await documentClient.put(params).promise()
        console.log('Adding API V1 Mapping result: ', result)

        apiHeader = process.env.ApiHeaderV2
        apiDomain = process.env.ApiDomainV2
        apiPath = process.env.ApiPathV2
        params = {
            TableName: tableName,
            Item:{
                "hk": apiHeader,
                "dn": apiDomain,
                "dp": apiPath
            }
        };
        console.log("Adding API V2 Mapping: ", params)
        result = await documentClient.put(params).promise()
        console.log('Adding API V2 Mapping result: ', result)

        console.log('initApiVers finished.')

    } catch (err) {
        console.error('initApiVers error: ', err)
    }
}

module.exports = { initApiVers }
