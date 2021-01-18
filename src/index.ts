export class MyMainClass {}
import { request, gql } from 'graphql-request'
const fs = require('fs')
import fetch from 'cross-fetch'

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
const filePath = './parents.json'
const TLD = 'domains' // TODO: Change to 'link'
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
          Object.keys(parents).forEach(key => {
            let children = parents[key]
            subdomains = [...subdomains, ...children]
          })
          console.log({
            subdomains:subdomains.length,
            parent:Object.keys(parents).length
          })
        }else{
          throw("Fetch data from subgraph")
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
      .slice(1,10)
      .forEach((key, index) => {
        if(key.length === 70 && key.match(/^\[.*\]\.eth$/)){
            undecodableDomains = undecodableDomains + 1
            console.log('***** IGNORE parent', key)
        }else{
            let children = parents[key]
            children.forEach(child => {
            let domain = `${child}.${key}.${TLD}`
            const fetchUrl = `https://eth.${TLD}/names/${domain}`
                if(child.length !== 66){
                    console.log(fetchUrl)
                    fetch(fetchUrl, { method: 'PUT'})
                    .then(c => {
                        console.log(index, domain, c.status)
                    })
                    .catch(e => {
                        console.log(index, domain, e.message)
                    })
                }else{
                    console.log('***** IGNORE child', fetchUrl)
                }
            })
        }
    })
    console.log({totalResolvers,subdomainsLength: subdomains.length, parentsLength: Object.keys(parents).length, nullDomains, undecodableDomains})
}

main()