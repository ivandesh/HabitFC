const res = await fetch('https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=Pedri')
const j = await res.json()
console.log(j.player?.[0]?.strThumb, '|', j.player?.[0]?.strPlayer)
