// Determine a set of links which need to be reversed to render the graph
// acyclic.
//
// https://pdfs.semanticscholar.org/c7ed/d9acce96ca357876540e19664eb9d976637f.pdf
// https://en.wikipedia.org/wiki/Feedback_arc_set

export function minFAS(graph) {
    let nodes = new Set()
    let indegrees = new Map()
    let outdegrees = new Map()
    for (let node of graph.nodes) {
        nodes.add(node)
        let incount = 0
        let outcount = 0
        for (let link of node.targetLinks) {
            if (link.source !== node) {
                incount++
            }
        }
        for (let link of node.sourceLinks) {
            if (link.target !== node) {
                outcount++
            }
        }
        indegrees.set(node, incount)
        outdegrees.set(node, outcount)
    }
    function remove(node) {
        nodes.delete(node)
        for (let link of node.targetLinks) {
            if (nodes.has(link.source)) {
                let subdegree = outdegrees.get(link.source)
                outdegrees.set(link.source, subdegree - 1)
            }
        }
        for (let link of node.sourceLinks) {
            if (nodes.has(link.target)) {
                let subdegree = indegrees.get(link.target)
                indegrees.set(link.target, subdegree - 1)
            }
        }
    }
    let s1 = []
    let s2 = []
    while (nodes.size > 0) {
        // Remove sink nodes until none are found.
        while (true) {
            let found = false
            for (let node of nodes) {
                let outdegree = outdegrees.get(node)
                if (outdegree === 0) {
                    found = true
                    s2.push(node)
                    remove(node)
                    /*nodes.delete(node)
                    for (let link of node.targetLinks) {
                        if (nodes.has(link.source)) {
                            let subdegree = outdegrees.get(link.source)
                            outdegrees.set(link.source, subdegree - 1)
                        }
                    }*/
                }
            }
            if (!found) {
                break
            }
        }
        // Remove source nodes until none are found.
        while (true) {
            let found = false
            for (let node of nodes) {
                let indegree = indegrees.get(node)
                if (indegree === 0) {
                    found = true
                    s1.push(node)
                    remove(node)
                    /*nodes.delete(node)
                    for (let link of node.sourceLinks) {
                        if (nodes.has(link.target)) {
                            let subdegree = indegrees.get(link.target)
                            indegrees.get(link.target, subdegree - 1)
                        }
                    }*/
                }
            }
            if (!found) {
                break
            }
        }
        if (nodes.size === 0) {
            break
        }
        let maxDelta = null
        let maxNode = null
        for (let node of nodes) {
            let delta = outdegrees.get(node) - indegrees.get(node)
            if (maxDelta === null || delta > maxDelta) {
                maxDelta = delta
                maxNode = node
            }
        }
        s1.push(maxNode)
        remove(maxNode)
    }
    s2.reverse()
    let order = s1.concat(s2)
    let orderMap = new Map()
    for (let [i, node] of order.entries()) {
        orderMap.set(node, i)
    }
    for (let link of graph.links) {
        let i = orderMap.get(link.source)
        let j = orderMap.get(link.target)
        if (i === j) {
            link.direction = "self"
        } else if (i < j) {
            link.direction = "forward"
        } else {
            link.direction = "backward"
        }
    }
}
