const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });
const TTL = 300000; // TTL of 5 minutes in ms
let apiVersionMappings;

function hasValue(mappings){
    if(typeof mappings === 'undefined') return false;
    if(mappings === null) return false;
    return true;
}

// Fetch API version mappings from external DynamoDB
async function fetchApiVersionMappings(tableName) {
    try {
        const params = { TableName: tableName };
        const data = await docClient.scan(params).promise();
        console.log("Fetched Data: \n" + JSON.stringify(data, null, 2))
        if(data.Count > 0) return data.Items;
    } catch (err) {
        console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
    }
    return null;
}

// Return API version mappings either from the cached or source
async function getApiVersionMappings(tableName) {
   
    // Check if API verion mappings is populated
    if(!hasValue(apiVersionMappings)) {       

        // Fetch API verion mappings from source and catche in memory
        apiVersionMappings = await fetchApiVersionMappings(tableName);

        // Set a timer to clear in memory catche
        if(hasValue(apiVersionMappings)) {
            setTimeout(() => {
                apiVersionMappings = undefined;
            }, TTL);
        }
    }
    return apiVersionMappings;
}

// Find a specific API version mapping by header
async function getApiVersionMapping(tableName, headerValue) {
    const mappings = await getApiVersionMappings(tableName);
    if(hasValue(mappings) && hasValue(headerValue)) {
        for (const mapping of mappings) {
            if(mapping.hk.toLowerCase() == headerValue.toLowerCase()){
                return mapping;
            }
        }
    }
    return null;
}

exports.lambdaHandler = async event => {
    
    const request = event.Records[0].cf.request;

    console.log('Request Received:\n' + JSON.stringify(request, null, 2))

    // Get DynamoDB table name from custom headers
    const tableName = request.origin.custom.customHeaders['custom-apigw-table-name'][0].value;

    // Get custom header name ex, 'Accept' or 'APIV'
    const headerName = request.origin.custom.customHeaders['custom-apigw-header-name'][0].value.toLowerCase();
    
    // Ensure custom header is provided
    if(!hasValue(request.headers[headerName])){
        return { status: '403', statusDescription: headerName + ' header is missing.' };
    }
    
    // Get API mapping version from custom header
    const headerValue = request.headers[headerName][0].value;
    if(!hasValue(headerValue) || headerValue == ''){
        return { status: '403', statusDescription: headerName + ' header is empty.' };
    }
    console.log("Lookup Info: \n" + JSON.stringify({tableName, headerName, headerValue}, null, 2))
    
    // Find origin mapping for the custom header
    const data = await getApiVersionMapping(tableName, headerValue);
    if(!hasValue(data)){
        return { status: '403', statusDescription: headerName + ' header is not a valid version.' };
    }
    console.log("API Version Mapping: \n" + JSON.stringify(data, null, 2))

    // Extract custom domain name (required) & custom path (optional)
    let destDomain = data.dn;
    let destPath = '';
    if(hasValue(data.dp)){
        destPath = data.dp;
    }

    request.origin = {
        custom: {
            domainName: destDomain,
            port: 443,
            protocol: 'https',
            path: destPath,
            sslProtocols: [
                'TLSv1',
                'TLSv1.1',
                'TLSv1.2'
            ],
            readTimeout: 5,
            keepaliveTimeout: 5,
            customHeaders: {}
        }
    };

    request.headers['host'] = [{ key: 'host', value: destDomain}];

    console.log('Request Returned:\n' + JSON.stringify(request, null, 2))

    return request;
}; 