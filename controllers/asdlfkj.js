let updatedItem =collData
let temp = [...notifications];
for(let i=0;i<temp.length;++i){
if(temp[i]._id.toString()===updatedItem._id.toString()){
    temp[i] = updatedItem
}
}
temp.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

setNotifications(temp)