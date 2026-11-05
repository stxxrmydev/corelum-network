CREATE TABLE objects(namespace TEXT NOT NULL,key TEXT NOT NULL,generation TEXT NOT NULL,size INTEGER NOT NULL,metadata TEXT NOT NULL,PRIMARY KEY(namespace,key));
CREATE TABLE object_chunks(generation TEXT NOT NULL,part INTEGER NOT NULL,data BLOB NOT NULL,PRIMARY KEY(generation,part));
