export class MyMainClass {}
import { request, gql } from 'graphql-request'
const moment = require('moment')
const fs = require('fs')
import fetch from 'cross-fetch'

export const GET_BLOCK = gql`
  query getBlock($timestamp: Int!){
    blocks(first: 1, orderBy: timestamp, orderDirection: asc, where: {timestamp_gt: $timestamp}) {
      id
      number
      timestamp
    }
  }   
`

export const GET_TIMESTAMP = gql`
  query getTimestamp($blockNumber: Int!){
    blocks(first: 1, orderBy: timestamp, orderDirection: asc, where: {number: $blockNumber}) {
      id
      number
      timestamp
    }
  }  
`

export const GET_CONTENTHASH_CHANGED = gql`
  query getContenthashChanged($blockNumber: Int!, $skip: Int!){
    contenthashChangeds(    
      first:1000, skip:$skip, orderBy:blockNumber, orderDirection:desc,
      where:{ blockNumber_gt: $blockNumber }
    ){
      blockNumber
      resolver{
        address
        domain{
          name
          parent{
            name
          }
        }
      }
    }
  }
`
export const GET_CONTENTHASH = gql`
query getResolvers($skip: Int!){  
  resolvers(first:1000, skip:$skip, where:{contentHash_not:null}){
    id
    domain{
      name
    }
    contentHash
  }
}
`

const ENSURL = 'https://api.thegraph.com/subgraphs/name/ensdomains/ens'
const BLOCKSURL = 'https://api.thegraph.com/subgraphs/name/blocklytics/ethereum-blocks'
const filePath = './parents.json'
let nullDomains = 0
let parents = {}
const appendSubdomains = (orgData, newData) => {
    const filtered = newData.filter(c => {
        let name = c.domain?.name
        if(!c?.domain?.name){
            nullDomains = nullDomains +1
        }else{
            let labels = name.split('.')
            let suffix = labels[labels.length - 1]
            return suffix === 'eth' && labels[1] !== 'eth'    
        }
    }).filter(e => !!e)
    return([...orgData, ...filtered])
}

const main = async () => {
    const perPage = 1000
    let skip = 0
    let subdomains = []
    let totalResolvers = 0
    let undecodableDomains = 0
    try {
        if (fs.existsSync(filePath)) {
          parents = JSON.parse(fs.readFileSync(filePath))

        }
    } catch(err) {
        let { resolvers } = await request(ENSURL, GET_CONTENTHASH, { skip })
        subdomains = appendSubdomains(subdomains, resolvers)
        while (resolvers.length === perPage) {
            console.log({skip})
            skip = skip + perPage
            resolvers = (await request(ENSURL, GET_CONTENTHASH, { skip })).resolvers
            totalResolvers = totalResolvers + resolvers.length
            subdomains = appendSubdomains(subdomains, resolvers)
        }
    
        console.log(JSON.stringify(subdomains[0]))
        subdomains.forEach(s => {
            if(!s?.domain?.name){
                throw('should not happen')
            }
            let labels = s?.domain?.name?.split('.')
            let label = labels[0]
            const parentName = labels.slice(1).join('.')
            if(!parents[parentName]){
                parents[parentName] = [label]
            }else{
                parents[parentName].push(label)
            }
        })
    
        fs.writeFile(filePath, JSON.stringify(parents), function(err) {
            if (err) {
                console.log(err);
            }
        });            
    }
    Object.keys(parents)
      // .slice(1,10)
      .forEach((key, index) => {
        if(key.length === 70 && key.match(/^\[.*\]\.eth$/)){
            undecodableDomains = undecodableDomains + 1
        }else{
            // To be changed from .domains to .link
            // const fetchUrl = `https://eth.domains/names/${key}.link`
            const fetchUrl = `https://eth.domains/names/${key}.domains`
            console.log(fetchUrl)
            fetch(fetchUrl, { method: 'PUT'})
              .then(c => {
                console.log(index, key, c.status)
              })
              .catch(e => {
                console.log(index, key, e.message)
              })
        }
    })
    console.log({totalResolvers,subdomainsLength: subdomains.length, parentsLength: Object.keys(parents).length, nullDomains, undecodableDomains})
}

main()